<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Amazon OAuth start URL is built server-side (src/lib/amazon-oauth.server.ts) with an HMAC-signed `state` from the session seller; why: seller_id in the URL was forgeable and let one seller bind an Amazon account to another.
- `ATLAS_OAUTH_STATE_SECRET` must hold the exact same value in the app (Lovable secrets and Vercel env vars), in the `amazon-auth` Edge Function secrets and in `temu-auth`; after changing it, redeploy on Vercel; why: the other end verifies the state's HMAC signature, so a mismatch returns "State inválido ou expirado".
- Requests the browser drops mid-flight (socket close → `Error: aborted` in Node's HTTP layer) are logged as `[client-abort]` warnings instead of errors (src/lib/error-capture.ts); why: they are navigation noise, not app failures, and reporting them as crashes blanks the editor preview.
