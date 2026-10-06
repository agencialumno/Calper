import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
  throw redirect(303, locals.investidor ? '/login/continuar' : '/login');
}
