import { Poppins } from 'next/font/google';
import './styles/globals.css';
import Header from './components/layout/header';

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
				<main className='min-h-screen pt-[88px]'>{children}</main>
			</body>
		</html>
	);
}
