"""Point package-lock.json (v1) tarball URLs from dead Chinese mirrors to registry.npmjs.org.

Usage: python fix-lock-mirrors.py <package-lock.json>
registry.npm.taobao.org and registry.nlark.com no longer serve packages; the integrity hashes stay valid
because the tarballs are identical.
"""
import json
import sys
from collections import Counter

DEAD = ('https://registry.npm.taobao.org/', 'http://registry.npm.taobao.org/', 'https://registry.nlark.com/')
path = sys.argv[1]
lock = json.load(open(path, encoding='utf-8'))
count = Counter()


def walk(deps):
    for name, info in (deps or {}).items():
        url = info.get('resolved')
        if isinstance(url, str) and url.startswith(DEAD):
            info['resolved'] = f"https://registry.npmjs.org/{name}/-/{name.split('/')[-1]}-{info['version']}.tgz"
            count[url.split('/')[2]] += 1
        walk(info.get('dependencies'))


walk(lock.get('dependencies'))
json.dump(lock, open(path, 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
print('rewritten:', dict(count))
