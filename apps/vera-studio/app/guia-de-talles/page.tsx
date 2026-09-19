import {InfoPage} from '../../components/InfoPage';

const measurements = [
  ['XS', '78–82 cm', '60–64 cm', '86–90 cm'],
  ['S', '83–87 cm', '65–69 cm', '91–95 cm'],
  ['M', '88–92 cm', '70–74 cm', '96–100 cm'],
  ['L', '93–98 cm', '75–80 cm', '101–106 cm'],
  ['XL', '99–104 cm', '81–86 cm', '107–112 cm']
];

export default function SizeGuidePage() {
  return <InfoPage eyebrow="Antes de elegir" title={<>Guía de<br/><em>talles.</em></>} lead="Las medidas cambian según la prenda y el calce. Esta guía te ayuda a empezar a elegir con más seguridad."><section className="info-page__content"><article className="info-grid"><h2>Guía orientativa</h2><div><p>Estas medidas son orientativas y no reemplazan la tabla real de cada prenda. Cuando Vera Studio defina sus medidas finales, este bloque se puede actualizar desde la configuración de catálogo.</p><div className="size-guide"><table><thead><tr><th>Talle</th><th>Busto</th><th>Cintura</th><th>Cadera</th></tr></thead><tbody>{measurements.map(row => <tr key={row[0]}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div></div></article><article className="info-grid"><h2>Cómo medirte</h2><div><ul className="measure-list"><li><b>01</b><span><strong>Busto:</strong> medí alrededor de la parte más amplia, sin ajustar de más el centímetro.</span></li><li><b>02</b><span><strong>Cintura:</strong> buscá la parte más angosta de tu torso y medí relajada.</span></li><li><b>03</b><span><strong>Cadera:</strong> medí alrededor de la zona más amplia de la cadera.</span></li></ul><div className="info-note">Si estás entre dos talles o buscás un calce particular, escribinos antes de comprar. Te ayudamos a leer cada prenda.</div></div></article></section></InfoPage>;
}
