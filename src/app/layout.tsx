import type { Metadata } from 'next';
import { Libre_Franklin, Roboto, Playfair_Display } from 'next/font/google';
import './styles/globals.css';
import Header from './components/layout/header';

const libreFranklin = Libre_Franklin({
	variable: '--font-libre-franklin',
	subsets: ['latin'],
});

const roboto = Roboto({
	variable: '--font-roboto',
	weight: ['400', '700'],
	subsets: ['latin'],
});

const playfair = Playfair_Display({
	variable: '--font-playfair',
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
				className={`${libreFranklin.variable} ${roboto.variable} ${playfair.variable} min-h-screen overflow-y-auto antialiased`}
			>
				<Header />
				<main className='min-h-screen pt-[88px]'>{children}</main>
			</body>
		</html>
	);
}
