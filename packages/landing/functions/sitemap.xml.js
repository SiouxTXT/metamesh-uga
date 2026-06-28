export async function onRequest(context) {
  const baseUrl = 'https://metamesh-uga.dev';
  
  const urls = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/docs', changefreq: 'weekly', priority: '0.9' },
    { loc: '/api', changefreq: 'weekly', priority: '0.9' },
    { loc: '/pricing', changefreq: 'monthly', priority: '0.7' },
    { loc: '/install', changefreq: 'monthly', priority: '0.8' },
  ];
  
  try {
    const res = await fetch('https://api.metamesh-uga.dev/v1/tools');
    const data = await res.json();
    
    for (const tool of (data.tools || [])) {
      urls.push({
        loc: `/tools/${tool.name}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: new Date().toISOString().split('T')[0]
      });
    }
  } catch (e) {
    // Fallback: sitemap without tool pages
  }
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;
  
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
