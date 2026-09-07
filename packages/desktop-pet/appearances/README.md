# 随包形象素材

[中文](README.md) | [English](README_en.md)

每个以形象 ID 命名的子目录包含 `pet.json`、`animations.json` 和 `Assets/`，使用 Dev Flow 原生动画包格式。
`scripts/build-desktop-pet.mjs` 将这些目录复制到应用的 `Contents/Resources/Appearances/`，并逐文件比较
原始素材与解包后素材。运行时直接读取应用资源，用户无需手动导入；同 ID 的用户导入副本优先。

## 鲸鱼娘

- 素材来自用户提供的 `whale-girl 3` 图集，显示名为“鲸鱼娘（8× 极清动画修复版）”。
- 形象 ID：`codex-d82c29b37c8838a51739d5d20268e608`，与该 Codex 包的导入 ID 一致。
- 保留九类动作、57 帧、1536×1664 画布和逐帧时长，PNG 文件总计 98,342,476 字节。
- 源图集尺寸为 12288×14976，SHA-256 为 `a3ed76daf3779c69181c797dda2eb08153943b313c4281c808f191f9200d41fa`。

这里保存完整的转换后帧，构建不依赖用户下载目录，也不重新编码图片。更新应用会更新内置资源；
用户已重新导入同 ID 形象时，继续使用用户副本，更新该副本需重新导入。格式与动作规则见
[桌面宠物指南](../../../docs/DESKTOP-PETS.md)。

## 验收方式

`PetAppearanceTests.testBundledWhaleGirlContainsNineHighResolutionActions` 从空用户目录列出并加载所有九类动作。
设置 `DEV_FLOW_PET_TEST_BUNDLED_ROOT` 为解包后的 `Contents/Resources/Appearances` 可检查最终包。
同一测试类还检查选择保存、同 ID 导入后的优先顺序，以及应用资源保持原样。
