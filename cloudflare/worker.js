const apiOrigin = 'https://forma-gym-app.onrender.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

    const upstream = new URL(apiOrigin)
    upstream.pathname = url.pathname
    upstream.search = url.search

    const headers = new Headers(request.headers)
    headers.delete('host')
    headers.delete('cf-access-jwt-assertion')
    headers.delete('cf-access-authenticated-user-email')
    const session = headers.get('cookie')?.split(';').map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith('forma_session='))
    headers.delete('cookie')
    if (session) headers.set('cookie', session)

    try {
      const response = await fetch(upstream, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
        cache: 'no-store',
      })
      const result = new Response(response.body, response)
      result.headers.set('Cache-Control', 'no-store')
      return result
    } catch {
      return Response.json({ error: 'Forma’s API is temporarily unavailable.' }, {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
  },
}
