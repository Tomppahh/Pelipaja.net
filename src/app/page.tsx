import Header from './components/header';
export default function Home() {
	return (
		<>
			<Header />
			<main className='flex min-h-screen flex-col items-center justify-center'>
				<h1 className='text-5xl font-bold italic font-franklin'>Pelipaja.net</h1>
				<p className='pt-5 font-bold font-franklin'>Tästä se lähtee</p>
			</main>
		</>
	);
}
