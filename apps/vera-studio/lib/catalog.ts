export const categories = ['Todos', 'Tops', 'Abrigos', 'Pantalones', 'Accesorios'] as const;
export type Category = Exclude<(typeof categories)[number], 'Todos'>;
export type Size = 'XS' | 'S' | 'M' | 'L' | 'Único';

export type Product = {
  id: string;
  name: string;
  price: number;
  category: Category;
  image: string;
  description: string;
  composition: string;
  care: string;
  colors: {name: string; value: string}[];
  sizes: Size[];
};

export const products: Product[] = [
  {id: 'camisa-alma', name: 'Camisa Alma', price: 48900, category: 'Tops', image: '/images/camisa-alma.webp', description: 'Camisa amplia de poplin liviano. Pensada para usar abierta, cerrada o arremangada.', composition: '100% algodón.', care: 'Lavar con agua fría. Secar a la sombra.', colors: [{name: 'Crudo', value: '#eee7da'}, {name: 'Negro', value: '#282522'}], sizes: ['XS', 'S', 'M', 'L']},
  {id: 'top-vera', name: 'Top Vera', price: 27900, category: 'Tops', image: '/images/top-vera.webp', description: 'Top de morley suave, al cuerpo y cómodo. Un básico que acompaña todo el día.', composition: '95% algodón, 5% elastano.', care: 'Lavar del revés con agua fría.', colors: [{name: 'Rosa viejo', value: '#bd8f8a'}, {name: 'Negro', value: '#282522'}], sizes: ['XS', 'S', 'M', 'L']},
  {id: 'remera-siena', name: 'Remera Siena', price: 29900, category: 'Tops', image: '/images/remera-siena.webp', description: 'Remera de algodón pesado con calce relajado y caída firme.', composition: '100% algodón peinado.', care: 'Lavar con colores similares.', colors: [{name: 'Marfil', value: '#f3eee5'}, {name: 'Taupe', value: '#9a8878'}], sizes: ['S', 'M', 'L']},
  {id: 'sweater-roma', name: 'Sweater Roma', price: 67900, category: 'Abrigos', image: '/images/sweater-roma.webp', description: 'Tejido suave de silueta holgada y cuello redondo. Abriga sin sentirse pesado.', composition: '70% algodón, 30% acrílico.', care: 'Lavar a mano. Secar en plano.', colors: [{name: 'Taupe', value: '#9b8878'}, {name: 'Crudo', value: '#e9dfd0'}], sizes: ['S', 'M', 'L']},
  {id: 'cardigan-olivia', name: 'Cardigan Olivia', price: 72900, category: 'Abrigos', image: '/images/cardigan-olivia.webp', description: 'Cardigan de punto con botones al tono. Fácil de combinar y amable al tacto.', composition: '60% algodón, 40% acrílico.', care: 'Lavar a mano. No retorcer.', colors: [{name: 'Rosa viejo', value: '#bd8f8a'}, {name: 'Arena', value: '#c8b79f'}], sizes: ['S', 'M', 'L']},
  {id: 'pantalon-ambar', name: 'Pantalón Ámbar', price: 64900, category: 'Pantalones', image: '/images/pantalon-ambar.webp', description: 'Pantalón sastrero de pierna ancha, tiro alto y cintura cómoda.', composition: 'Gabardina sastrera con elastano.', care: 'Lavar en ciclo delicado.', colors: [{name: 'Camel', value: '#b68e68'}, {name: 'Negro', value: '#282522'}], sizes: ['XS', 'S', 'M', 'L']},
  {id: 'jean-clara', name: 'Jean Clara', price: 69900, category: 'Pantalones', image: '/images/jean-clara.webp', description: 'Jean recto de tiro alto con denim firme que cede apenas con el uso.', composition: '99% algodón, 1% elastano.', care: 'Lavar del revés con agua fría.', colors: [{name: 'Azul medio', value: '#667d91'}], sizes: ['XS', 'S', 'M', 'L']},
  {id: 'falda-nerea', name: 'Falda Nerea', price: 51900, category: 'Pantalones', image: '/images/falda-nerea.webp', description: 'Falda midi con movimiento y cintura limpia. Funciona de día y de noche.', composition: 'Satén mate.', care: 'Lavar a mano con agua fría.', colors: [{name: 'Negro', value: '#282522'}, {name: 'Taupe', value: '#9b8878'}], sizes: ['XS', 'S', 'M', 'L']},
  {id: 'blazer-elena', name: 'Blazer Elena', price: 98900, category: 'Abrigos', image: '/images/blazer-elena.webp', description: 'Blazer de estructura suave y calce relajado. Sastrería simple para usar mucho.', composition: 'Poliviscosa con forrería liviana.', care: 'Limpieza en seco.', colors: [{name: 'Taupe', value: '#8c7769'}, {name: 'Negro', value: '#282522'}], sizes: ['S', 'M', 'L']},
  {id: 'bolso-lia', name: 'Bolso Lía', price: 45900, category: 'Accesorios', image: '/images/bolso-lia.webp', description: 'Bolso compacto con correa regulable y espacio para lo esencial.', composition: 'Cuero vegano texturado.', care: 'Limpiar con paño apenas húmedo.', colors: [{name: 'Rosa viejo', value: '#bd8f8a'}, {name: 'Negro', value: '#282522'}], sizes: ['Único']}
];

export const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);
