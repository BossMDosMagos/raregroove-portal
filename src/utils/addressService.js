import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

/**
 * Busca todos os endereços do usuário
 */
export const fetchUserAddresses = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar endereços:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar endereços:', error);
    return [];
  }
};

/**
 * Busca o endereço principal/default do usuário
 */
export const fetchDefaultAddress = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (é normal se não tem default)
      console.error('Erro ao buscar endereço default:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Erro ao buscar endereço default:', error);
    return null;
  }
};

/**
 * Cria um novo endereço para o usuário
 */
export const createAddress = async (userId, addressData) => {
  try {
    // Se for o primeiro endereço, setar como default
    const addresses = await fetchUserAddresses(userId);
    const isFirstAddress = addresses.length === 0;

    const { data, error } = await supabase
      .from('user_addresses')
      .insert({
        user_id: userId,
        ...addressData,
        is_default: isFirstAddress
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar endereço:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao criar endereço:', error);
    throw error;
  }
};

/**
 * Atualiza um endereço existente
 */
export const updateAddress = async (addressId, addressData) => {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .update({
        ...addressData,
        updated_at: new Date()
      })
      .eq('id', addressId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar endereço:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao atualizar endereço:', error);
    throw error;
  }
};

/**
 * Deleta um endereço
 */
export const deleteAddress = async (addressId) => {
  try {
    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', addressId);

    if (error) {
      console.error('Erro ao deletar endereço:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Erro ao deletar endereço:', error);
    throw error;
  }
};

/**
 * Define um endereço como principal/default
 */
export const setAddressAsDefault = async (addressId) => {
  try {
    const { error } = await supabase
      .rpc('set_address_as_default', { address_id: addressId });

    if (error) {
      console.error('Erro ao definir endereço como default:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Erro ao definir endereço como default:', error);
    throw error;
  }
};

/**
 * Valida os dados do endereço
 */
export const validateAddress = (addressData) => {
  const errors = [];

  if (!addressData.label?.trim()) {
    errors.push('Rótulo do endereço é obrigatório (ex: Casa, Trabalho)');
  }

  if (!addressData.full_name?.trim()) {
    errors.push('Nome completo é obrigatório');
  }

  const cepClean = addressData.cep?.replace(/\D/g, '');
  if (!cepClean || cepClean.length !== 8) {
    errors.push('CEP inválido (deve ter 8 dígitos)');
  }

  if (!addressData.address?.trim()) {
    errors.push('Endereço é obrigatório');
  }

  if (!addressData.number?.trim()) {
    errors.push('Número é obrigatório');
  }

  if (!addressData.city?.trim()) {
    errors.push('Cidade é obrigatória');
  }

  const stateClean = addressData.state?.trim().toUpperCase();
  if (!stateClean || stateClean.length !== 2) {
    errors.push('Estado deve ser uma sigla de 2 letras (UF)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
