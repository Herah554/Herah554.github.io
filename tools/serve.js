/* Statisk server for tools/.out — bare til lokal testing.
   Kjør: node tools/serve.js  →  http://localhost:8765/rotarsak-test.html */
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.join(__dirname,".out");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css"};
http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/,"")||"rotarsak-test.html";
  fs.readFile(path.join(root,rel),(e,b)=>{
    if(e){res.writeHead(404);res.end("nope");return;}
    res.writeHead(200,{"content-type":mime[path.extname(rel)]||"application/octet-stream"});res.end(b);
  });
}).listen(8765,()=>console.log("serving "+root+" on 8765"));
