-- 샘플 데이터 삽입

-- T우주 샘플 프리셋 데이터 삽입
INSERT INTO subscription_presets (name, provider, description, is_official, template) 
VALUES (
  'T우주 - 배달의민족',
  'SKT',
  '배달의민족 3천원 쿠폰 3장 제공',
  true,
  '{
    "subscription": {
      "name": "T우주",
      "provider": "SKT",
      "is_active": true,
      "sub_products": []
    },
    "sub_products": [
      {
        "name": "배달의민족 3천원 쿠폰 #1",
        "type": "coupon",
        "quantity": 1,
        "validity_period": 30,
        "is_used": false,
        "description": "3천원 할인 쿠폰"
      },
      {
        "name": "배달의민족 3천원 쿠폰 #2", 
        "type": "coupon",
        "quantity": 1,
        "validity_period": 30,
        "is_used": false,
        "description": "3천원 할인 쿠폰"
      },
      {
        "name": "배달의민족 3천원 쿠폰 #3",
        "type": "coupon", 
        "quantity": 1,
        "validity_period": 30,
        "is_used": false,
        "description": "3천원 할인 쿠폰"
      }
    ]
  }'::jsonb
);

-- 네이버플러스 샘플 프리셋
INSERT INTO subscription_presets (name, provider, description, is_official, template) 
VALUES (
  '네이버플러스 멤버십',
  '네이버',
  '네이버페이 적립, 무료배송 혜택 제공',
  true,
  '{
    "subscription": {
      "name": "네이버플러스 멤버십",
      "provider": "네이버",
      "is_active": true,
      "sub_products": []
    },
    "sub_products": [
      {
        "name": "네이버페이 적립 혜택",
        "type": "benefit",
        "quantity": 1,
        "validity_period": 365,
        "is_used": false,
        "description": "결제 시 추가 적립"
      },
      {
        "name": "무료배송 혜택",
        "type": "benefit",
        "quantity": 1,
        "validity_period": 365,
        "is_used": false,
        "description": "스마트스토어 무료배송"
      }
    ]
  }'::jsonb
);

-- 샘플 배너 데이터
INSERT INTO banners (title, image_url, position, is_active) 
VALUES 
  ('T우주', 'https://via.placeholder.com/300x120/FF6B6B/FFFFFF?text=T우주', 1, true),
  ('네이버플러스', 'https://via.placeholder.com/300x120/4ECDC4/FFFFFF?text=네이버플러스', 2, true),
  ('쿠팡 와우', 'https://via.placeholder.com/300x120/45B7D1/FFFFFF?text=쿠팡와우', 3, true);