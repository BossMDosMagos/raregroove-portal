import { supabase } from '../lib/supabase';

const DISCOGS_API_BASE = 'https://api.discogs.com';
const DISCOGS_USER_AGENT = 'RareGroove/3.0';

export const discogsService = {
  async searchReleases(query, options = {}) {
    try {
      const params = new URLSearchParams({
        q: query,
        type: 'release',
        per_page: options.limit || 20,
        page: options.page || 1,
      });

      if (options.year) params.append('year', options.year);
      if (options.genre) params.append('genre', options.genre);
      if (options.country) params.append('country', options.country);
      if (options.format) params.append('format', options.format);

      const token = import.meta.env.VITE_DISCOGS_TOKEN;
      if (!token) {
        console.warn('[DISCOGS] Missing API token. Skipping request.');
        return { data: [], error: 'Missing API token' };
      }

      const response = await fetch(`${DISCOGS_API_BASE}/database/search?${params}`, {
        headers: {
          'User-Agent': DISCOGS_USER_AGENT,
          'Accept': 'application/json',
          'Authorization': `Discogs token=${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      const data = await response.json();
      return { data: data.results, error: null };
    } catch (error) {
      console.error('Discogs search error:', error);
      return { data: [], error };
    }
  },

  async getRelease(releaseId) {
    try {
      const response = await fetch(`${DISCOGS_API_BASE}/releases/${releaseId}`, {
        headers: {
          'User-Agent': DISCOGS_USER_AGENT,
          'Accept': 'application/json',
          'Authorization': `Discogs token=${import.meta.env.VITE_DISCOGS_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('Discogs get release error:', error);
      return { data: null, error };
    }
  },

  async getMasterRelease(masterId) {
    try {
      const response = await fetch(`${DISCOGS_API_BASE}/masters/${masterId}`, {
        headers: {
          'User-Agent': DISCOGS_USER_AGENT,
          'Accept': 'application/json',
          'Authorization': `Discogs token=${import.meta.env.VITE_DISCOGS_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('Discogs get master error:', error);
      return { data: null, error };
    }
  },

  async getArtist(artistId) {
    try {
      const response = await fetch(`${DISCOGS_API_BASE}/artists/${artistId}`, {
        headers: {
          'User-Agent': DISCOGS_USER_AGENT,
          'Accept': 'application/json',
          'Authorization': `Discogs token=${import.meta.env.VITE_DISCOGS_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('Discogs get artist error:', error);
      return { data: null, error };
    }
  },

  async getPriceSuggestions(releaseId) {
    try {
      const { data: release, error } = await this.getRelease(releaseId);
      
      if (error || !release) {
        return { data: null, error };
      }

      const priceSuggestions = {
        veryGood: release.lowest_price?.value || 0,
        good: (release.lowest_price?.value || 0) * 1.5,
        nearMint: (release.lowest_price?.value || 0) * 2,
        mint: (release.lowest_price?.value || 0) * 3,
        suggested: release.lowest_price?.value || release.community?.price?.suggested || 0,
        currency: release.lowest_price?.currency || 'USD',
      };

      return { data: priceSuggestions, error: null };
    } catch (error) {
      console.error('Price suggestions error:', error);
      return { data: null, error };
    }
  },

  async importFromDiscogs(releaseId, userId) {
    try {
      const { data: release, error } = await this.getRelease(releaseId);

      if (error || !release) {
        throw new Error('Failed to fetch release from Discogs');
      }

      const itemData = {
        seller_id: userId,
        title: release.title,
        artist: release.artists_sort || release.artists?.[0]?.name || 'Unknown Artist',
        discogs_id: release.id,
        discogs_master_id: release.master_id,
        year: release.year,
        genre: release.genres?.[0] || 'Unknown',
        styles: release.styles || [],
        format: release.formats?.[0]?.name || 'CD',
        description: release.notes || '',
        country: release.country,
        label: release.labels?.[0]?.name || 'Unknown Label',
        catno: release.labels?.[0]?.catno,
        image_url: release.images?.[0]?.uri || null,
        thumb_url: release.thumb || null,
      };

      const { data: item, error: insertError } = await supabase
        .from('items')
        .insert(itemData)
        .select()
        .single();

      if (insertError) throw insertError;

      return { data: item, error: null };
    } catch (error) {
      console.error('Import from Discogs error:', error);
      return { data: null, error };
    }
  },

  async syncFromDiscogs(itemId) {
    try {
      const { data: item, error: fetchError } = await supabase
        .from('items')
        .select('discogs_id')
        .eq('id', itemId)
        .single();

      if (fetchError || !item?.discogs_id) {
        throw new Error('Item not linked to Discogs');
      }

      const { data: release, error: discogsError } = await this.getRelease(item.discogs_id);

      if (discogsError || !release) {
        throw new Error('Failed to fetch from Discogs');
      }

      const updateData = {
        title: release.title,
        artist: release.artists_sort || release.artists?.[0]?.name,
        year: release.year,
        genre: release.genres?.[0],
        styles: release.styles,
        image_url: release.images?.[0]?.uri || item.image_url,
        discogs_master_id: release.master_id,
        discogs_updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateError } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', itemId)
        .select()
        .single();

      if (updateError) throw updateError;

      return { data: updated, error: null };
    } catch (error) {
      console.error('Sync from Discogs error:', error);
      return { data: null, error };
    }
  },

  async verifyRelease(releaseId) {
    try {
      const { data, error } = await this.getRelease(releaseId);

      if (error || !data) {
        return { verified: false, error };
      }

      const verification = {
        verified: true,
        releaseId: data.id,
        title: data.title,
        artist: data.artists_sort,
        year: data.year,
        formats: data.formats?.map((f) => f.name) || [],
        genres: data.genres || [],
        country: data.country,
        labels: data.labels?.map((l) => ({ name: l.name, catno: l.catno })) || [],
        hasImages: (data.images?.length || 0) > 0,
        communityRating: data.community?.rating?.average?.toFixed(1) || null,
        haveCount: data.community?.have || 0,
        wantCount: data.community?.want || 0,
      };

      return { data: verification, error: null };
    } catch (error) {
      console.error('Verify release error:', error);
      return { verified: false, error };
    }
  },

  formatDiscogsData(release) {
    return {
      id: release.id,
      title: release.title,
      artist: release.artists_sort || release.artists?.[0]?.name,
      year: release.year,
      country: release.country,
      format: release.formats?.map((f) => `${f.name} (${f.qty})`).join(', '),
      label: release.labels?.map((l) => `${l.name} ${l.catno}`).join(', '),
      genre: release.genres?.join(', '),
      style: release.styles?.join(', '),
      coverImage: release.images?.[0]?.uri,
      thumbnail: release.thumb,
      lowestPrice: release.lowest_price?.value,
      description: release.notes,
    };
  },
};

export const discogsGradingService = {
  GRADING_SCALES: {
    MINT: { code: 'M', name: 'Mint', description: 'Perfect condition' },
    NEAR_MINT: { code: 'NM', name: 'Near Mint', description: 'Almost perfect' },
    VERY_GOOD_PLUS: { code: 'VG+', name: 'Very Good Plus', description: 'Shows some signs of play' },
    VERY_GOOD: { code: 'VG', name: 'Very Good', description: 'Surface noise evident' },
    GOOD: { code: 'G', name: 'Good', description: 'Significant wear' },
    FAIR: { code: 'F', name: 'Fair', description: 'Heavy wear' },
    POOR: { code: 'P', name: 'Poor', description: 'Barely playable' },
  },

  async suggestGrade(releaseId) {
    try {
      const { data, error } = await discogsService.getRelease(releaseId);

      if (error || !data) {
        return { data: null, error };
      }

      const suggestions = {
        sleeveGrade: 'VG+',
        mediaGrade: 'NM',
        priceSuggestion: data.lowest_price?.value || 0,
        basedOn: `${data.community?.have || 0} listings`,
      };

      return { data: suggestions, error: null };
    } catch (error) {
      console.error('Suggest grade error:', error);
      return { data: null, error };
    }
  },
};
