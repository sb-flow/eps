import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page">
      <h1>Запись не найдена</h1>
      <Link href="/">Вернуться к объектам</Link>
    </main>
  );
}
