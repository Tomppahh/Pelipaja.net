import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './styles/globals.css';
import Header from './components/layout/header';

export const metadata: Metadata = {
	title: 'Pelipaja.net',
	description: 'Create custom CS2 matches with your friends. Login with Steam to create or join a lobby.',
};

const poppins = Poppins({
	variable: '--font-poppins',
	weight: ['400', '500', '600', '700'],
	style: ['normal'],
	subsets: ['latin'],
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='fi'>
			<body
				className={`${poppins.variable} min-h-screen overflow-y-auto antialiased`}
			>
				<Header />
				<div className='min-h-screen pt-[88px]'>{children}</div>
			</body>
		</html>
	);
}
