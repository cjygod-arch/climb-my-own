/**
 * data/static/jsonSource.js — 정적 JSON 로더.
 *
 * import.meta.url 기준으로 경로를 푼다. document.baseURI를 쓰지 않는 이유:
 * GitHub Pages는 저장소 하위 경로(/repo/)로 배포되는데, import.meta.url 기준이면
 * 배포 위치가 어디든 항상 올바르게 해석된다.
 *
 * 한 번 읽은 파일은 캐시한다. 100대 명산 데이터는 세션 중 바뀌지 않는다.
 */

import { ok, err, ErrorCode } from '../../core/result.js';

const cache = new Map();

/**
 * @param {string} fileName public/data/ 하위 파일명
 * @returns {Promise<Result<object>>}
 */
export async function loadJson(fileName) {
  if (cache.has(fileName)) return ok(cache.get(fileName));

  const url = new URL(`../../../public/data/${fileName}`, import.meta.url);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return err(ErrorCode.NETWORK, `데이터를 불러오지 못했습니다. (${response.status})`);
    }
    const json = await response.json();
    cache.set(fileName, json);
    return ok(json);
  } catch (cause) {
    return err(ErrorCode.NETWORK, '데이터를 불러오지 못했습니다. 연결을 확인해 주세요.', cause);
  }
}

/** items 배열만 꺼낸다. 파일 형태가 { version, items } 로 고정되어 있다. */
export async function loadItems(fileName) {
  const result = await loadJson(fileName);
  if (!result.ok) return result;
  const items = result.value?.items;
  if (!Array.isArray(items)) {
    return err(ErrorCode.UNEXPECTED, `${fileName} 형식이 올바르지 않습니다.`);
  }
  return ok(items);
}

export function clearCache() {
  cache.clear();
}
