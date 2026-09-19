import {AdminApp} from '../../../../components/AdminApp';
export default async function OrderPage({params}: {params: Promise<{id: string}>}) { const {id} = await params; return <AdminApp view="order" orderId={id}/>; }
