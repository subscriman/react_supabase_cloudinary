import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import DocumentPicker from 'react-native-document-picker';
import { SubscriptionPreset, Subscription } from '../../../shared/types';

export class PresetService {
  // XML 형태로 프리셋 내보내기
  static async exportPresetToXML(preset: SubscriptionPreset): Promise<string> {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<subscription-preset>
  <info>
    <name>${preset.name}</name>
    <provider>${preset.provider}</provider>
    <description>${preset.description}</description>
    <created-by>${preset.createdBy}</created-by>
  </info>
  <subscription>
    <name>${preset.template.subscription.name}</name>
    <provider>${preset.template.subscription.provider}</provider>
    <payment-amount>${preset.template.subscription.paymentAmount || ''}</payment-amount>
    <payment-method>${preset.template.subscription.paymentMethod || ''}</payment-method>
  </subscription>
  <sub-products>
    ${preset.template.subProducts.map(subProduct => `
    <sub-product>
      <name>${subProduct.name}</name>
      <type>${subProduct.type}</type>
      <quantity>${subProduct.quantity || 1}</quantity>
      <validity-period>${subProduct.validityPeriod || ''}</validity-period>
      <description>${subProduct.description || ''}</description>
    </sub-product>`).join('')}
  </sub-products>
</subscription-preset>`;

    return xmlContent;
  }

  // 파일로 프리셋 내보내기
  static async exportPresetToFile(preset: SubscriptionPreset): Promise<boolean> {
    try {
      const xmlContent = await this.exportPresetToXML(preset);
      const fileName = `${preset.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_preset.xml`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      await RNFS.writeFile(filePath, xmlContent, 'utf8');

      // 파일 공유
      const shareOptions = {
        title: '구독 프리셋 공유',
        message: `${preset.name} 프리셋을 공유합니다.`,
        url: `file://${filePath}`,
        type: 'application/xml',
      };

      await Share.open(shareOptions);
      return true;
    } catch (error) {
      console.error('Error exporting preset:', error);
      return false;
    }
  }

  // XML 파일에서 프리셋 가져오기
  static async importPresetFromFile(): Promise<SubscriptionPreset | null> {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.xml, DocumentPicker.types.allFiles],
      });

      const filePath = result[0].uri;
      const xmlContent = await RNFS.readFile(filePath, 'utf8');

      return this.parseXMLToPreset(xmlContent);
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        console.log('User cancelled file picker');
      } else {
        console.error('Error importing preset:', error);
      }
      return null;
    }
  }

  // XML 파싱하여 프리셋 객체로 변환
  static parseXMLToPreset(xmlContent: string): SubscriptionPreset | null {
    try {
      // 간단한 XML 파싱 (실제로는 xml2js 같은 라이브러리 사용 권장)
      const nameMatch = xmlContent.match(/<name>(.*?)<\/name>/);
      const providerMatch = xmlContent.match(/<provider>(.*?)<\/provider>/);
      const descriptionMatch = xmlContent.match(/<description>(.*?)<\/description>/);

      if (!nameMatch || !providerMatch) {
        throw new Error('Invalid XML format');
      }

      // 서브 상품들 파싱
      const subProductMatches = xmlContent.match(/<sub-product>(.*?)<\/sub-product>/gs) || [];
      const subProducts = subProductMatches.map(subProductXml => {
        const subNameMatch = subProductXml.match(/<name>(.*?)<\/name>/);
        const subTypeMatch = subProductXml.match(/<type>(.*?)<\/type>/);
        const subQuantityMatch = subProductXml.match(/<quantity>(.*?)<\/quantity>/);
        const subValidityMatch = subProductXml.match(/<validity-period>(.*?)<\/validity-period>/);
        const subDescMatch = subProductXml.match(/<description>(.*?)<\/description>/);

        return {
          name: subNameMatch?.[1] || '',
          type: (subTypeMatch?.[1] as 'coupon' | 'benefit' | 'service') || 'benefit',
          quantity: parseInt(subQuantityMatch?.[1] || '1'),
          validityPeriod: parseInt(subValidityMatch?.[1] || '0') || undefined,
          isUsed: false,
          description: subDescMatch?.[1] || '',
        };
      });

      const preset: SubscriptionPreset = {
        id: `imported-${Date.now()}`,
        name: nameMatch[1],
        provider: providerMatch[1],
        description: descriptionMatch?.[1] || '',
        isOfficial: false,
        createdBy: 'imported',
        likes: 0,
        downloads: 0,
        template: {
          subscription: {
            name: nameMatch[1],
            provider: providerMatch[1],
            isActive: true,
            subProducts: [],
          },
          subProducts,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return preset;
    } catch (error) {
      console.error('Error parsing XML:', error);
      return null;
    }
  }

  // 구독 상품을 프리셋으로 변환
  static subscriptionToPreset(subscription: Subscription, userId: string): SubscriptionPreset {
    return {
      id: `user-${Date.now()}`,
      name: subscription.name,
      provider: subscription.provider,
      description: `${subscription.name} 사용자 프리셋`,
      isOfficial: false,
      createdBy: userId,
      likes: 0,
      downloads: 0,
      template: {
        subscription: {
          name: subscription.name,
          provider: subscription.provider,
          paymentAmount: subscription.paymentAmount,
          paymentMethod: subscription.paymentMethod,
          isActive: true,
          subProducts: [],
        },
        subProducts: subscription.subProducts.map(subProduct => ({
          name: subProduct.name,
          type: subProduct.type,
          quantity: subProduct.quantity,
          validityPeriod: subProduct.validityPeriod,
          isUsed: false,
          description: subProduct.description,
        })),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}