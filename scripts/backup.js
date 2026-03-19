#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
const BACKUP_PATH = process.env.BACKUP_PATH || './backups';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ACCESS_TOKEN, {
  auth: { persistSession: false }
});

async function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

async function exportDatabase() {
  log('Iniciando exportação do banco de dados...');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `raregroove-db-${timestamp}.sql`;
    const filepath = join(BACKUP_PATH, filename);

    if (!existsSync(BACKUP_PATH)) {
      mkdirSync(BACKUP_PATH, { recursive: true });
    }

    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
    if (!projectRef) {
      throw new Error('Não foi possível extrair project ref da URL');
    }

    const pgDumpCommand = `pg_dump -h db.${projectRef}.supabase.co -U postgres -d postgres -F c -b -v -f "${filepath}"`;
    
    log(`Executando: pg_dump...`);
    execSync(pgDumpCommand, {
      env: {
        ...process.env,
        PGPASSWORD: SUPABASE_DB_PASSWORD
      },
      stdio: 'inherit'
    });

    log(`Backup salvo em: ${filepath}`);

    await cleanupOldBackups(filepath);
    
    return { success: true, filepath, timestamp };
  } catch (error) {
    log(`Erro ao exportar banco: ${error.message}`, 'ERROR');
    throw error;
  }
}

async function exportStorage() {
  log('Iniciando exportação de arquivos storage...');
  
  const buckets = ['avatars', 'items', 'dispute-evidence', 'withdrawal-proofs'];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = join(BACKUP_PATH, `storage-${timestamp}`);
  
  mkdirSync(storagePath, { recursive: true });

  for (const bucket of buckets) {
    try {
      log(`Exportando bucket: ${bucket}...`);
      
      const { data: files, error } = await supabaseAdmin.storage
        .from(bucket)
        .list('', { limit: 1000 });

      if (error) {
        log(`Erro ao listar ${bucket}: ${error.message}`, 'WARN');
        continue;
      }

      if (!files || files.length === 0) {
        log(`Bucket ${bucket} vazio, pulando...`);
        continue;
      }

      const bucketPath = join(storagePath, bucket);
      mkdirSync(bucketPath, { recursive: true });

      for (const file of files) {
        if (file.name && !file.id) continue;
        
        const { data, error: downloadError } = await supabaseAdmin.storage
          .from(bucket)
          .download(file.name);

        if (downloadError) {
          log(`Erro ao baixar ${file.name}: ${downloadError.message}`, 'WARN');
          continue;
        }

        const filePath = join(bucketPath, file.name);
        writeFileSync(filePath, Buffer.from(await data.arrayBuffer()));
      }

      log(`Bucket ${bucket} exportado com ${files.length} arquivos`);
    } catch (error) {
      log(`Erro ao exportar bucket ${bucket}: ${error.message}`, 'WARN');
    }
  }

  return { success: true, path: storagePath };
}

async function exportMetadata() {
  log('Exportando metadados e configurações...');
  
  const tables = [
    'profiles',
    'items',
    'transactions',
    'swaps',
    'shipping',
    'disputes',
    'user_balances',
    'financial_ledger',
    'platform_settings'
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const metadataPath = join(BACKUP_PATH, `metadata-${timestamp}.json`);
  
  const metadata = {};

  for (const table of tables) {
    try {
      const { data, error } = await supabaseAdmin.from(table).select('*').limit(10000);
      
      if (error) {
        log(`Erro ao exportar ${table}: ${error.message}`, 'WARN');
        continue;
      }

      metadata[table] = data;
      log(`Exportado ${table}: ${data?.length || 0} registros`);
    } catch (error) {
      log(`Erro ao exportar ${table}: ${error.message}`, 'WARN');
    }
  }

  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  log(`Metadados salvos em: ${metadataPath}`);

  return { success: true, path: metadataPath };
}

async function cleanupOldBackups(newBackupPath) {
  log(`Limpando backups antigos (retention: ${BACKUP_RETENTION_DAYS} dias)...`);
  
  try {
    const files = readdirSync(BACKUP_PATH)
      .filter(f => f.startsWith('raregroove-db-') && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: join(BACKUP_PATH, f),
        time: fs.statSync(join(BACKUP_PATH, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);

    let deleted = 0;
    for (const file of files) {
      if (file.time < cutoff) {
        unlinkSync(file.path);
        deleted++;
      }
    }

    log(`${deleted} backups antigos removidos`);
  } catch (error) {
    log(`Erro ao limpar backups: ${error.message}`, 'WARN');
  }
}

async function sendNotification(status, details) {
  if (process.env.DISCORD_WEBHOOK_URL) {
    const color = status === 'success' ? 3066993 : 15158332;
    const message = {
      embeds: [{
        title: `Backup ${status === 'success' ? '✅ Concluído' : '❌ Falhou'}`,
        color,
        fields: details,
        timestamp: new Date().toISOString()
      }]
    };

    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }
}

async function main() {
  log('='.repeat(50));
  log('INICIANDO BACKUP RAREGROOVE');
  log('='.repeat(50));

  const startTime = Date.now();
  const results = [];

  try {
    if (!SUPABASE_URL || !SUPABASE_ACCESS_TOKEN) {
      throw new Error('Variáveis de ambiente SUPABASE_URL e SUPABASE_ACCESS_TOKEN são obrigatórias');
    }

    const dbResult = await exportDatabase();
    results.push({ name: 'Database', value: `✅ ${basename(dbResult.filepath)}` });

    const storageResult = await exportStorage();
    results.push({ name: 'Storage', value: `✅ ${basename(storageResult.path)}` });

    const metadataResult = await exportMetadata();
    results.push({ name: 'Metadata', value: `✅ ${basename(metadataResult.path)}` });

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log(`Backup concluído em ${duration} minutos`);

    await sendNotification('success', results);

    process.exit(0);
  } catch (error) {
    log(`FALHA NO BACKUP: ${error.message}`, 'ERROR');
    
    await sendNotification('failure', [
      { name: 'Erro', value: error.message }
    ]);

    process.exit(1);
  }
}

main();
