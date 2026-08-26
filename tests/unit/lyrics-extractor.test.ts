import assert from "node:assert/strict"
import test from "node:test"
import { extractDynamicSnippets } from "@/lib/lyrics-extractor"

test("dynamic lyrics extraction", async (t) => {
  await t.test("extracts high-quality snippets from plain lyrics", () => {
    const rawLyrics = `[Verse 1]
Em, ngày em đánh rơi nụ cười vào anh
Có nghĩ sau này em sẽ chờ
Và vô tư cho đi hết những ngây thơ

[Chorus]
Em không là nàng thơ
Anh cũng không còn là nhạc sĩ mộng mơ
Tình này nhẹ như gió
Lại trĩu lên tim ta những vết hằn

[Verse 2]
Mai, ngày em sải bước bên đời thênh thang
Chỉ cần một điều em hãy nhớ
Có một người từng yêu em tha thiết vô bờ`

    const track = {
      name: "Nàng Thơ",
      artists: "Hoàng Dũng",
    }

    const snippets = extractDynamicSnippets(rawLyrics, track)
    assert.ok(snippets.length >= 2, "Should extract at least 2 distinct snippets")
    assert.ok(
      snippets.some((s) => s.includes("đánh rơi nụ cười")),
      "Should contain verse 1"
    )
  })

  await t.test("handles empty and invalid lyrics gracefully", () => {
    assert.deepEqual(extractDynamicSnippets("", { name: "Test", artists: "Artist" }), [])
    assert.deepEqual(extractDynamicSnippets("Short text", { name: "Test", artists: "Artist" }), [])
  })
})
