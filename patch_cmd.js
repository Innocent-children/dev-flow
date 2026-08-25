const fs = require('fs');

function patch(f) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/`npm pack` 下载 `latest` 指向的官方 package，并把 tarball 写入当前目录；命令替换保存实际文件名。\nDSH `plugin add` 接收该 tarball 的绝对路径，将 package、bundle layer、Skill、guard 与 MCP child\n加入指定 profile。安装后按 DSH 的 profile lifecycle 停止并重启该 profile。/, 
  '统一 CLI 会在后台自动完成临时 tarball 的获取和 DSH 插件注册。安装后按 DSH 的 profile lifecycle 停止并重启该 profile。');
  fs.writeFileSync(f, c);
}
patch('docs/COMMANDS.md');
