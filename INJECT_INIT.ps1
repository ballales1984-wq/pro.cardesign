$rawContent = [System.IO.File]::ReadAllText("D:/pro.cardesign/src/mesh-exporter.js");
$start = $rawContent.IndexOf("static _MC_TRI_SRC");
$before = $rawContent.Substring(0, $start);
$after = $rawContent.Substring($start);
$newFile = $before + @"

  /** Build MC_TRI_TABLE[] from _MC_TRI_SRC — called once at class load time */
  static _initMC() {
    const TABLE = this.MC_TRI_TABLE = [];
    const src = this._MC_TRI_SRC;
    const digits = '0123456789ab';
    const parseSeg = (t) => {
      const segs = [];
      let last = '';
      for (let j = 0; j <= t.length; j++) {
        const ch = j < t.length ? t[j] : '|';
        if (ch === '|') {
          if (last.length) { segs.push(parseInt(last, 12)); last = ''; }
        } else if (digits.includes(ch)) {
          last += ch;
        }
      }
      return segs;
    };
    for (let i = 0; i < src.length; i++) {
      const row = [];
      for (const tri of src[i].split('|')) {
        const edges = parseSeg(tri);
        if (edges.length >= 3) row.push(edges[0], edges[1], edges[2]);
      }
      TABLE[i] = row;
    }
  }

"@ + $after;
[System.IO.File]::WriteAllText("D:/pro.cardesign/src/mesh-exporter.js", $newFile, [System.Text.UTF8Encoding]::new($false));
"Done - file saved, $(($newFile.Length / 1024).ToString('N1')) KB"