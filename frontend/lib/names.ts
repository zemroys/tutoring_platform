// "Фамилия Имя", а если имя не указано (старые аккаунты), то email
export function fullName(first: string | null, last: string | null, email: string): string {
  const name = [last, first].filter(Boolean).join(" ");
  return name || email;
}
