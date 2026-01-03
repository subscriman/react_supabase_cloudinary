import { supabase } from '../config/supabase';
import { Subscription, SubProduct, SubscriptionPreset } from '../../../shared/types';

export class SubscriptionService {
  // 구독 상품 CRUD
  static async createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert([subscription])
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      return null;
    }

    return data;
  }

  static async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        sub_products (*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return [];
    }

    return data || [];
  }

  static async updateSubscription(id: string, updates: Partial<Subscription>): Promise<boolean> {
    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating subscription:', error);
      return false;
    }

    return true;
  }

  static async deleteSubscription(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting subscription:', error);
      return false;
    }

    return true;
  }

  // 서브 상품 관리
  static async addSubProduct(subProduct: Omit<SubProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubProduct | null> {
    const { data, error } = await supabase
      .from('sub_products')
      .insert([subProduct])
      .select()
      .single();

    if (error) {
      console.error('Error adding sub product:', error);
      return null;
    }

    return data;
  }

  static async updateSubProduct(id: string, updates: Partial<SubProduct>): Promise<boolean> {
    const { error } = await supabase
      .from('sub_products')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating sub product:', error);
      return false;
    }

    return true;
  }

  // 프리셋 관리
  static async getPresets(isOfficial?: boolean): Promise<SubscriptionPreset[]> {
    let query = supabase
      .from('subscription_presets')
      .select('*')
      .order('likes', { ascending: false });

    if (isOfficial !== undefined) {
      query = query.eq('is_official', isOfficial);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching presets:', error);
      return [];
    }

    return data || [];
  }

  static async createPreset(preset: Omit<SubscriptionPreset, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'downloads'>): Promise<SubscriptionPreset | null> {
    const { data, error } = await supabase
      .from('subscription_presets')
      .insert([preset])
      .select()
      .single();

    if (error) {
      console.error('Error creating preset:', error);
      return null;
    }

    return data;
  }

  static async likePreset(userId: string, presetId: string): Promise<boolean> {
    const { error } = await supabase
      .from('preset_likes')
      .insert([{ user_id: userId, preset_id: presetId }]);

    if (error) {
      console.error('Error liking preset:', error);
      return false;
    }

    // 좋아요 수 증가
    await supabase.rpc('increment_preset_likes', { preset_id: presetId });

    return true;
  }

  static async unlikePreset(userId: string, presetId: string): Promise<boolean> {
    const { error } = await supabase
      .from('preset_likes')
      .delete()
      .eq('user_id', userId)
      .eq('preset_id', presetId);

    if (error) {
      console.error('Error unliking preset:', error);
      return false;
    }

    // 좋아요 수 감소
    await supabase.rpc('decrement_preset_likes', { preset_id: presetId });

    return true;
  }

  // 프리셋 적용
  static async applyPreset(userId: string, preset: SubscriptionPreset): Promise<Subscription | null> {
    const subscriptionData = {
      ...preset.template.subscription,
      user_id: userId,
    };

    const subscription = await this.createSubscription(subscriptionData);
    if (!subscription) return null;

    // 서브 상품들 추가
    for (const subProductTemplate of preset.template.subProducts) {
      await this.addSubProduct({
        ...subProductTemplate,
        subscription_id: subscription.id,
      });
    }

    // 다운로드 수 증가
    await supabase.rpc('increment_preset_downloads', { preset_id: preset.id });

    return subscription;
  }
}