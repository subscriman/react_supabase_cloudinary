import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { SubscriptionPreset } from '../../shared/types';

interface PresetFormData {
  name: string;
  provider: string;
  description: string;
  paymentAmount?: number;
  paymentMethod?: string;
  subProducts: {
    name: string;
    type: 'coupon' | 'benefit' | 'service';
    quantity?: number;
    validityPeriod?: number;
    description?: string;
  }[];
}

interface PresetFormProps {
  onPresetCreated: (preset: SubscriptionPreset) => void;
}

export default function PresetForm({ onPresetCreated }: PresetFormProps) {
  const [loading, setLoading] = useState(false);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<PresetFormData>({
    defaultValues: {
      subProducts: [{ name: '', type: 'benefit', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subProducts',
  });

  const onSubmit = async (data: PresetFormData) => {
    setLoading(true);
    try {
      const presetData = {
        name: data.name,
        provider: data.provider,
        description: data.description,
        is_official: true,
        created_by: 'admin', // TODO: 실제 관리자 ID
        template: {
          subscription: {
            name: data.name,
            provider: data.provider,
            payment_amount: data.paymentAmount,
            payment_method: data.paymentMethod,
            is_active: true,
            sub_products: [],
          },
          sub_products: data.subProducts.map(sp => ({
            name: sp.name,
            type: sp.type,
            quantity: sp.quantity || 1,
            validity_period: sp.validityPeriod,
            is_used: false,
            description: sp.description,
          })),
        },
      };

      const { data: newPreset, error } = await supabase
        .from('subscription_presets')
        .insert([presetData])
        .select()
        .single();

      if (error) throw error;

      onPresetCreated(newPreset);
      reset();
      alert('프리셋이 성공적으로 등록되었습니다.');
    } catch (error) {
      console.error('Error creating preset:', error);
      alert('프리셋 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 기본 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상품명 *
          </label>
          <input
            {...register('name', { required: '상품명을 입력하세요' })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="예: T우주"
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            제공업체 *
          </label>
          <input
            {...register('provider', { required: '제공업체를 입력하세요' })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="예: SKT"
          />
          {errors.provider && (
            <p className="text-red-500 text-sm mt-1">{errors.provider.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          설명 *
        </label>
        <textarea
          {...register('description', { required: '설명을 입력하세요' })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="프리셋에 대한 설명을 입력하세요"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            결제 금액 (선택)
          </label>
          <input
            {...register('paymentAmount', { valueAsNumber: true })}
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="예: 50000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            결제 수단 (선택)
          </label>
          <input
            {...register('paymentMethod')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="예: 신용카드"
          />
        </div>
      </div>

      {/* 서브 상품 */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-medium text-gray-700">
            서브 상품/혜택
          </label>
          <button
            type="button"
            onClick={() => append({ name: '', type: 'benefit', quantity: 1 })}
            className="px-3 py-1 bg-primary-500 text-white text-sm rounded-md hover:bg-primary-600"
          >
            + 추가
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="border border-gray-200 rounded-md p-4">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  서브 상품 #{index + 1}
                </h4>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    삭제
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <input
                    {...register(`subProducts.${index}.name` as const, {
                      required: '서브 상품명을 입력하세요',
                    })}
                    type="text"
                    placeholder="서브 상품명"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <select
                    {...register(`subProducts.${index}.type` as const)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="benefit">혜택</option>
                    <option value="coupon">쿠폰</option>
                    <option value="service">서비스</option>
                  </select>
                </div>

                <div>
                  <input
                    {...register(`subProducts.${index}.quantity` as const, {
                      valueAsNumber: true,
                    })}
                    type="number"
                    placeholder="수량"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <input
                    {...register(`subProducts.${index}.validityPeriod` as const, {
                      valueAsNumber: true,
                    })}
                    type="number"
                    placeholder="유효기간 (일)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="mt-3">
                <textarea
                  {...register(`subProducts.${index}.description` as const)}
                  placeholder="설명 (선택)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '등록 중...' : '프리셋 등록'}
        </button>
      </div>
    </form>
  );
}