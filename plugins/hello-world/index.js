/**
 * Hello World 示例插件
 * 展示 MindCode 插件系统基础功能
 */

function activate(context, api) {
  console.log('[HelloWorld] 插件已激活');

  // 注册 "Say Hello" 命令
  const helloCmd = api.commands.registerCommand('helloWorld.sayHello', async () => {
    const name = await api.window.showInputBox({ prompt: '请输入你的名字', value: 'MindCode' });
    if (name) api.editor.showMessage(`Hello, ${name}! 👋`, 'info');
  });

  // 注册 "Insert Date" 命令
  const dateCmd = api.commands.registerCommand('helloWorld.insertDate', () => {
    const date = new Date().toLocaleString('zh-CN');
    api.editor.showMessage(`当前时间: ${date}`, 'info');
  });

  // 添加到订阅列表（用于清理）
  context.subscriptions.push(helloCmd, dateCmd);
}

function deactivate() {
  console.log('[HelloWorld] 插件已停用');
}

// 导出激活/停用函数
module.exports = { activate, deactivate };
