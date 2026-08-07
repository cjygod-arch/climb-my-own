/**
 * core/dom.js — DOM 생성 헬퍼.
 *
 * 이 파일은 도메인을 모른다. 산·코스·배지 같은 단어가 등장하면 잘못된 것이다.
 * 프레임워크로 이행할 때 통째로 버려지는 유일한 core 파일이다.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 엘리먼트를 만든다.
 *
 * @param {string} tag
 * @param {Object} [props] class/text/html/style/dataset/on* 및 나머지는 속성으로 처리
 * @param {Array<Node|string|null|undefined|false>} [children]
 * @returns {HTMLElement}
 *
 * @example
 * el('button', { class: 'btn btn--primary', onClick: save }, ['저장'])
 */
export function el(tag, props = {}, children = []) {
  return build(document.createElement(tag), props, children);
}

/**
 * SVG 엘리먼트를 만든다. HTML과 네임스페이스가 다르므로 별도 함수가 필요하다.
 *
 * @param {string} tag
 * @param {Object} [props]
 * @param {Array<Node|string|null|undefined|false>} [children]
 * @returns {SVGElement}
 */
export function svg(tag, props = {}, children = []) {
  return build(document.createElementNS(SVG_NS, tag), props, children);
}

function build(node, props, children) {
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') {
      setClass(node, value);
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'html') {
      node.innerHTML = String(value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      for (const [dk, dv] of Object.entries(value)) {
        if (dv !== null && dv !== undefined) node.dataset[dk] = String(dv);
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  appendAll(node, children);
  return node;
}

function setClass(node, value) {
  const name = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
  if (node instanceof SVGElement) node.setAttribute('class', name);
  else node.className = name;
}

/** 자식을 붙인다. false/null/undefined 는 건너뛴다(조건부 렌더링 편의). */
export function appendAll(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false || child === '') continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** 문서 조각. 여러 노드를 한 번에 반환할 때 쓴다. */
export function frag(children = []) {
  return appendAll(document.createDocumentFragment(), children);
}

/**
 * 컨테이너를 비우고 새 노드를 넣는다.
 * 이전 노드에 destroy()가 실려 있으면 호출한다(구독 해제 경로).
 */
export function mount(container, node) {
  clear(container);
  if (node) container.append(node);
  return node;
}

/** 컨테이너를 비우면서 자식들의 destroy()를 호출한다. */
export function clear(container) {
  for (const child of Array.from(container.childNodes)) {
    destroy(child);
  }
  container.replaceChildren();
  return container;
}

/** 노드와 그 하위의 정리 함수를 재귀 호출한다. */
export function destroy(node) {
  if (!node) return;
  if (node.childNodes) {
    for (const child of Array.from(node.childNodes)) destroy(child);
  }
  if (typeof node.destroy === 'function') {
    node.destroy();
    node.destroy = null;
  }
}

/**
 * 노드에 정리 함수를 붙인다. 여러 번 호출하면 순서대로 누적된다.
 *
 * @example
 * onDestroy(node, store.subscribe(render))
 */
export function onDestroy(node, fn) {
  if (typeof fn !== 'function') return node;
  const prev = node.destroy;
  node.destroy = () => {
    if (prev) prev();
    fn();
  };
  return node;
}

/**
 * 이벤트를 붙이고 해제 함수를 돌려준다.
 * @returns {() => void}
 */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** 위임 이벤트. 목록에서 항목 클릭을 잡을 때 쓴다. */
export function delegate(root, type, selector, handler) {
  return on(root, type, (event) => {
    const match = event.target.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  });
}
