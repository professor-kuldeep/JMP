export function selectPosts(posts, params = {}, perPage = 9) {
  const q = String(params.q || '').trim().slice(0,100);
  const category = String(params.category || '');
  const author = String(params.author || '');
  const filtered = posts.filter(post => (!category || post.blogCategory === category) && (!author || (post.blogAuthor || 'JMP Editorial Team') === author) && (!q || [post.title,post.heroText,post.metaDescription,post.blogCategory,post.blogAuthor,JSON.stringify(post.sections || [])].join(' ').toLowerCase().includes(q.toLowerCase())));
  const totalPages = Math.max(1,Math.ceil(filtered.length/perPage));
  const requested = Number.parseInt(params.page,10);
  const page = Math.min(totalPages,Math.max(1,Number.isFinite(requested)?requested:1));
  return {q,category,author,page,totalPages,total:filtered.length,items:filtered.slice((page-1)*perPage,page*perPage)};
}
export function blogHref(params = {}) {
  const query = new URLSearchParams();
  for (const key of ['category','author','q','page']) if (params[key] && !(key === 'page' && Number(params[key]) === 1)) query.set(key,String(params[key]));
  return '/blog'+(query.size?'?'+query.toString():'');
}
