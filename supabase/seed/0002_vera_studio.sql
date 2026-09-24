-- Vera Studio tenant + catalog seed. This is real client data, not demo data.
-- Run this ONLY when provisioning or restoring Vera Studio's own Supabase project.
-- Do NOT run it against a new NADAV Custom client's project — it used to be baked into
-- 0002_commerce_schema.sql and was extracted here for exactly that reason.
begin;

insert into public.core_restaurants(id,slug,name,config) values ('77777777-7777-4777-8777-777777777777','vera-studio','Vera Studio','{"identity":{"slug":"vera-studio","name":"Vera Studio","locale":"es-AR","currency":"ARS","timeZone":"America/Argentina/Buenos_Aires"}}'::jsonb) on conflict(slug) do nothing;
insert into public.core_commerce_content(restaurant_id,content,settings)
select id,'{"heroEyebrow":"Nueva colección · Primavera","heroTitle":"Vestirse","heroEmphasis":"como una misma.","heroDescription":"Prendas simples, femeninas y pensadas para usar una y otra vez.","studioCopy":"Seleccionamos cada prenda pensando en cómo se usa de verdad: con qué combina, cómo cae y cuánto la vas a elegir.","shippingNote":"Preparamos cada pedido desde nuestro estudio."}'::jsonb,'{"storeName":"Vera Studio","currency":"ARS","pickupEnabled":true,"deliveryEnabled":true,"deliveryFee":4500}'::jsonb from public.core_restaurants where slug='vera-studio' on conflict(restaurant_id) do nothing;
insert into public.core_commerce_categories(restaurant_id,slug,name,position)
select r.id,seed.slug,seed.name,seed.position from public.core_restaurants r cross join (values ('tops','Tops',1),('abrigos','Abrigos',2),('pantalones','Pantalones',3),('accesorios','Accesorios',4)) as seed(slug,name,position) where r.slug='vera-studio' on conflict(restaurant_id,slug) do nothing;

with seed(slug,name,category_slug,price,image,description,composition,care,colors,sizes) as (values
('camisa-alma','Camisa Alma','tops',48900,'/images/camisa-alma.webp','Camisa amplia de poplin liviano. Pensada para usar abierta, cerrada o arremangada.','100% algodón.','Lavar con agua fría. Secar a la sombra.','[{"name":"Crudo","value":"#eee7da"},{"name":"Negro","value":"#282522"}]'::jsonb,'["XS","S","M","L"]'::jsonb),
('top-vera','Top Vera','tops',27900,'/images/top-vera.webp','Top de morley suave, al cuerpo y cómodo. Un básico que acompaña todo el día.','95% algodón, 5% elastano.','Lavar del revés con agua fría.','[{"name":"Rosa viejo","value":"#bd8f8a"},{"name":"Negro","value":"#282522"}]'::jsonb,'["XS","S","M","L"]'::jsonb),
('remera-siena','Remera Siena','tops',29900,'/images/remera-siena.webp','Remera de algodón pesado con calce relajado y caída firme.','100% algodón peinado.','Lavar con colores similares.','[{"name":"Marfil","value":"#f3eee5"},{"name":"Taupe","value":"#9a8878"}]'::jsonb,'["S","M","L"]'::jsonb),
('sweater-roma','Sweater Roma','abrigos',67900,'/images/sweater-roma.webp','Tejido suave de silueta holgada y cuello redondo. Abriga sin sentirse pesado.','70% algodón, 30% acrílico.','Lavar a mano. Secar en plano.','[{"name":"Taupe","value":"#9b8878"},{"name":"Crudo","value":"#e9dfd0"}]'::jsonb,'["S","M","L"]'::jsonb),
('cardigan-olivia','Cardigan Olivia','abrigos',72900,'/images/cardigan-olivia.webp','Cardigan de punto con botones al tono. Fácil de combinar y amable al tacto.','60% algodón, 40% acrílico.','Lavar a mano. No retorcer.','[{"name":"Rosa viejo","value":"#bd8f8a"},{"name":"Arena","value":"#c8b79f"}]'::jsonb,'["S","M","L"]'::jsonb),
('pantalon-ambar','Pantalón Ámbar','pantalones',64900,'/images/pantalon-ambar.webp','Pantalón sastrero de pierna ancha, tiro alto y cintura cómoda.','Gabardina sastrera con elastano.','Lavar en ciclo delicado.','[{"name":"Camel","value":"#b68e68"},{"name":"Negro","value":"#282522"}]'::jsonb,'["XS","S","M","L"]'::jsonb),
('jean-clara','Jean Clara','pantalones',69900,'/images/jean-clara.webp','Jean recto de tiro alto con denim firme que cede apenas con el uso.','99% algodón, 1% elastano.','Lavar del revés con agua fría.','[{"name":"Azul medio","value":"#667d91"}]'::jsonb,'["XS","S","M","L"]'::jsonb),
('falda-nerea','Falda Nerea','pantalones',51900,'/images/falda-nerea.webp','Falda midi con movimiento y cintura limpia. Funciona de día y de noche.','Satén mate.','Lavar a mano con agua fría.','[{"name":"Negro","value":"#282522"},{"name":"Taupe","value":"#9b8878"}]'::jsonb,'["XS","S","M","L"]'::jsonb),
('blazer-elena','Blazer Elena','abrigos',98900,'/images/blazer-elena.webp','Blazer de estructura suave y calce relajado. Sastrería simple para usar mucho.','Poliviscosa con forrería liviana.','Limpieza en seco.','[{"name":"Taupe","value":"#8c7769"},{"name":"Negro","value":"#282522"}]'::jsonb,'["S","M","L"]'::jsonb),
('bolso-lia','Bolso Lía','accesorios',45900,'/images/bolso-lia.webp','Bolso compacto con correa regulable y espacio para lo esencial.','Cuero vegano texturado.','Limpiar con paño apenas húmedo.','[{"name":"Rosa viejo","value":"#bd8f8a"},{"name":"Negro","value":"#282522"}]'::jsonb,'["Único"]'::jsonb)
), inserted as (
insert into public.core_commerce_products(restaurant_id,category_id,slug,name,description,price,images,composition,care)
select r.id,c.id,s.slug,s.name,s.description,s.price,jsonb_build_array(s.image),s.composition,s.care from seed s join public.core_restaurants r on r.slug='vera-studio' join public.core_commerce_categories c on c.restaurant_id=r.id and c.slug=s.category_slug on conflict(restaurant_id,slug) do nothing returning id,slug,restaurant_id
)
insert into public.core_commerce_variants(restaurant_id,product_id,color,color_value,size,stock)
select p.restaurant_id,p.id,color.value->>'name',color.value->>'value',size.value#>>'{}',30 from inserted p join seed s on s.slug=p.slug cross join lateral jsonb_array_elements(s.colors) color(value) cross join lateral jsonb_array_elements(s.sizes) size(value);

commit;
