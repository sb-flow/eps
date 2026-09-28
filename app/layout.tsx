import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Construction Radar UZ · EPS CRM",
  description: "Объекты и участники строительства Узбекистана",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="app-header">
          <Link href="/" className="brand">
            <b className="brand-icon">CR</b>
            <span>
              Construction Radar<small>UZBEKISTAN / EPS CRM</small>
            </span>
          </Link>
          <nav>
            <Link href="/">Объекты</Link>
            <Link href="/companies">Компании</Link>
            <Link href="/specifications">Спецификации</Link>
            <Link href="/products">Каталог</Link>
            <Link href="/login">Аккаунт</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
