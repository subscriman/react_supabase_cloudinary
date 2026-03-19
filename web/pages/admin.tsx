import Head from 'next/head';
import AdminDashboard from '../components/AdminDashboard';

export default function AdminPage() {
  return (
    <>
      <Head>
        <title>Subscriman | 관리자</title>
        <meta name="description" content="Subscriman 관리자 페이지" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <AdminDashboard />
    </>
  );
}
