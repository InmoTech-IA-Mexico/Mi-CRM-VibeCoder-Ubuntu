export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col justify-center px-4">
      {children}
    </div>
  );
}
