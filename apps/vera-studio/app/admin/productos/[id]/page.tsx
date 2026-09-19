import {AdminApp} from '../../../../components/AdminApp';
export default async function ProductPage({params}: {params: Promise<{id: string}>}) { const {id} = await params; return <AdminApp view="product-edit" productId={id}/>; }
