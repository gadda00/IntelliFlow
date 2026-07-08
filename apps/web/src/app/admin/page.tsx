import { redirect } from 'next/navigation';

/**
 * /admin — redirect to the agent management page.
 * The dashboard overview lives at /admin/system for a quick health snapshot,
 * but agents is the most common landing destination for ops work.
 */
export default function AdminIndexPage() {
  redirect('/admin/agents');
}
