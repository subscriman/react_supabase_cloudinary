import fs from 'fs/promises';
import path from 'path';
import Head from 'next/head';
import { GetStaticProps } from 'next';
import UserMembershipWorkspace from '../components/UserMembershipWorkspace';
import { SeedData } from '../lib/user-membership';

interface HomePageProps {
  seedData: SeedData;
}

export default function HomePage({ seedData }: HomePageProps) {
  return (
    <>
      <Head>
        <title>Subscriman | 통신사 혜택 설정</title>
        <meta
          name="description"
          content="통신사 멤버십 혜택을 선택하고 개인 설정값으로 저장하는 웹 샘플"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <UserMembershipWorkspace seedData={seedData} />
    </>
  );
}

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  const seedPath = path.join(process.cwd(), '..', 'docs', 'preset_seed.json');
  const raw = await fs.readFile(seedPath, 'utf8');
  const seedData = JSON.parse(raw) as SeedData;

  return {
    props: {
      seedData,
    },
  };
};
