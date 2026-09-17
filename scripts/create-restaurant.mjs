import {
  cpSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {resolve} from 'node:path';

const slug = process.argv[2];
const port = Number(process.argv[3] ?? 3002);

if (!slug || !/^[a-z][a-z0-9-]{2,49}$/.test(slug)) {
  console.error(
    'Uso: npm run create:restaurant -- nombre-del-restaurante [puerto]'
  );
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Puerto inválido.');
  process.exit(1);
}

const source = resolve('starters/nadav-restaurant-starter');
const destination = resolve('apps', slug);

if (existsSync(destination)) {
  console.error(`Ya existe ${destination}`);
  process.exit(1);
}

cpSync(source, destination, {
  recursive: true,
  filter: sourcePath => {
    const normalized = sourcePath.replaceAll('\\', '/');

    return ![
      '/.next',
      '/node_modules',
      '/.env.local',
      '/.env',
      '/.turbo',
      '/coverage',
    ].some(part => normalized.includes(part));
  },
});

const packagePath = resolve(destination, 'package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

pkg.name = `@nadav/restaurant-${slug}`;
pkg.scripts = {
  dev: `next dev --hostname 0.0.0.0 --port ${port}`,
  build: 'next build --webpack',
  start: `next start --hostname 0.0.0.0 --port ${port}`,
};

writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const configPath = resolve(destination, 'restaurant.config.ts');

let config = readFileSync(configPath, 'utf8')
  .replaceAll('new-restaurant', slug)
  .replaceAll(
    "'[http://localhost:3000](http://localhost:3000)'",
    "'http://localhost:3000'"
  );

writeFileSync(configPath, config);

const envPath = resolve(destination, '.env.local');

writeFileSync(
  envPath,
  [
    'NEXT_PUBLIC_NADAV_CORE_URL=http://localhost:3000',
    `NEXT_PUBLIC_NADAV_RESTAURANT_SLUG=${slug}`,
    '',
  ].join('\n')
);

console.log('');
console.log(`✓ Restaurante creado: ${destination}`);
console.log(`✓ Slug: ${slug}`);
console.log(`✓ Puerto local: ${port}`);
console.log('');
console.log('Siguientes pasos:');
console.log(`  cd apps/${slug}`);
console.log('  npm run dev');
console.log('');
console.log(
  'Recordá registrar el restaurante en NADAV Core antes de usar su slug.'
);
