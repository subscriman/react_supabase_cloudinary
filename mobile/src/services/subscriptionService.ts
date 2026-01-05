import { supabase } from '../config/supabase';
import { Subscription, SubProduct, SubscriptionPreset } from '../../../shared/types';

export class SubscriptionService {
  // 구독 상품 생성
  static async createSubscription(subscriptionData: Partial<Subscription>): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([subscriptionData])
        .select()
        .single();

      if (error) {
        console.error('Error creating subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating subscription:', error);
      return null;
    }
  }

  // 서브 상품 추가
  static async addSubProduct(subProductData: Partial<SubProduct>): Promise<SubProduct | null> {
    try {
      const { data, error } = await supabase
        .from('sub_products')
        .insert([subProductData])
        .select()
        .single();

      if (error) {
        console.error('Error adding sub product:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error adding sub product:', error);
      return null;
    }
  }

  // 프리셋 목록 가져오기
  static async getPresets(isOfficial: boolean = false): Promise<SubscriptionPreset[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_presets')
        .select('*')
        .eq('is_official', isOfficial)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching presets:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching presets:', error);
      return [];
    }
  }

  // 사용자 구독 목록 가져오기
  static async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          sub_products (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user subscriptions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      return [];
    }
  }
}