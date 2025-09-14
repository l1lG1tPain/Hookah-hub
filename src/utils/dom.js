export const $ = (sel, root=document) => root.querySelector(sel);
export function el(tag, attrs={}, ...children){
    const node = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
        if (k === 'class') node.className = v;
        else node.setAttribute(k, v);
    }
    for (const ch of children) node.append(ch);
    return node;
}
