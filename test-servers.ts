import { createServer, listServers, destroyServer } from './src/backend/services/gameServerService';

async function main() {
  console.log('Creating 3 servers...');
  
  const s1 = await createServer('de_nuke');
  console.log('Server 1:', s1);
  
  const s2 = await createServer('de_mirage');
  console.log('Server 2:', s2);
  
  const s3 = await createServer('de_inferno');
  console.log('Server 3:', s3);
  
  console.log('\nAll servers:');
  console.log(listServers());
}

main().catch(console.error);
