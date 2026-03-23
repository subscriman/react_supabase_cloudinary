import fs from 'fs/promises';
import path from 'path';
import Head from 'next/head';
import { GetStaticProps } from 'next';
import MobileMembershipApp from '../components/MobileMembershipApp';
import { SeedData } from '../lib/user-membership';

interface MobilePageProps {
  seedData: SeedData;
}

export default function MobilePage({ seedData }: MobilePageProps) {
  return (
    <>
      <Head>
        <title>Subscriman Mobile | 구독 관리</title>
        <meta
          name="description"
          content="Subscriman 모바일 샘플 화면으로 홈, 추천, 내 구독, 상세 관리를 확인할 수 있습니다."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <MobileMembershipApp seedData={seedData} />
    </>
  );
}

export const getStaticProps: GetStaticProps<MobilePageProps> = async () => {
  const seedPath = path.join(process.cwd(), '..', 'docs', 'preset_seed.json');
  const raw = await fs.readFile(seedPath, 'utf8');
  const seedData = JSON.parse(raw) as SeedData;

  return {
    props: {
      seedData,
    },
  };
};
