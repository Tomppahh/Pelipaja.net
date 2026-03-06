// SAMPLE CODE FOR FUTURE REFERENCE


import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const MAX_SERVERS = 5;
const BASE_NAME = 'Pelipaja';

async function getActiveServers(): Promise<string[]> {
	const containers = await docker.listContainers({ all: false });
	return containers
		.map((c) => c.Names[0].replace('/', ''))
		.filter((name) => name.startsWith(BASE_NAME));
}

async function launchServer(image: string, volumePath: string) {
	const active = await getActiveServers();
	if (active.length >= MAX_SERVERS) {
		throw new Error('Max server limit reached');
	}
	const nextIndex = active.length + 1;
	const containerName = `${BASE_NAME}${nextIndex}`;
	const container = await docker.createContainer({
		Image: image,
		name: containerName,
		HostConfig: {
			Binds: [`${volumePath}/${containerName}:/data`],
		},
	});
	await container.start();
	return containerName;
}
