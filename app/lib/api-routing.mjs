const HTTP_METHODS=['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'];
function routeSegments(pattern){return pattern.split('/').filter(Boolean);}
export function matchApiRoute(routes,segments){
 if(!Array.isArray(segments)||segments.some(s=>typeof s!=='string'||!s))return null;
 // Resolve the URL first, then its method. A static route must never fall through to a dynamic deletion handler.
 const candidates=routes.map(route=>({...route,segments:routeSegments(route.path)})).filter(route=>route.segments.length===segments.length&&route.segments.every((s,i)=>s.startsWith(':')||s===segments[i])).sort((a,b)=>b.segments.filter(s=>!s.startsWith(':')).length-a.segments.filter(s=>!s.startsWith(':')).length);
 if(!candidates.length)return null;
 const route=candidates[0],params=Object.fromEntries(route.segments.flatMap((part,i)=>part.startsWith(':')?[[part.slice(1),segments[i]]]:[]));
 return {route,params};
}
export function allowedMethods(handlers){const allowed=HTTP_METHODS.filter(method=>typeof handlers[method]==='function');if(allowed.includes('GET')&&!allowed.includes('HEAD'))allowed.push('HEAD');if(!allowed.includes('OPTIONS'))allowed.push('OPTIONS');return HTTP_METHODS.filter(method=>allowed.includes(method));}
export function createApiDispatcher(routes){
 return async function dispatch(request,context={}){
  const {path}=await(context.params||Promise.resolve({})),matched=matchApiRoute(routes,path);
  if(!matched)return Response.json({message:'Not found.'},{status:404});
  const {route,params}=matched,method=request.method.toUpperCase(),allowed=allowedMethods(route.handlers),allow=allowed.join(', ');
  const routeContext={...context,params:Promise.resolve(params)};
  if(method==='OPTIONS'&&!route.handlers.OPTIONS)return new Response(null,{status:204,headers:{Allow:allow}});
  const handler=route.handlers[method]||(method==='HEAD'?route.handlers.GET:null);
  if(typeof handler!=='function')return Response.json({message:'Method not allowed.'},{status:405,headers:{Allow:allow}});
  const response=await handler(request,routeContext);
  if(method!=='HEAD')return response;
  if(response.body)await response.body.cancel().catch(()=>{});
  return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers});
 };
}
