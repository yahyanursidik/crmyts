import { environmentArg, readVault } from './access-runtime';

const environment = environmentArg();
const vault = readVault(environment);
if (!vault) throw new Error('Vault belum tersedia untuk lingkungan ini.');
console.log(`Kredensial ${environment}; hanya ditampilkan secara lokal untuk pengguna Windows yang menyimpannya.`);
console.table(vault.accounts.map(({ email, role, password }) => ({ email, role, password })));
