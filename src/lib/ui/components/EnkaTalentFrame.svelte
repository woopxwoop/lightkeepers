<!-- Enka SvgIcon Circl frame for talent icons (viewBox 0 0 14 14). -->
<script lang="ts">
  let { uid = "t" }: { uid?: string } = $props();
  const a = $derived(`enka-circl-a-${uid}`);
  const b = $derived(`enka-circl-b-${uid}`);
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class="SvgIcon Circl"
  viewBox="0 0 14 14"
  aria-hidden="true"
>
  <defs>
    <linearGradient
      id={a}
      x1="7.03"
      x2="7.03"
      y1="1.455"
      y2="12.322"
      gradientTransform="matrix(.80836 0 0 .82012 1.247 1.345)"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" style="stop-color:currentColor;stop-opacity:0"></stop>
      <stop
        offset=".446"
        style="stop-color:currentColor;stop-opacity:.80000001"
      ></stop>
      <stop
        offset=".548"
        style="stop-color:currentColor;stop-opacity:.80000001"
      ></stop>
      <stop offset="1" style="stop-color:currentColor;stop-opacity:0"></stop>
    </linearGradient>
    <linearGradient
      id={b}
      x1="7.03"
      x2="7.03"
      y1="1.794"
      y2="12.257"
      gradientTransform="translate(1.239 1.243)scale(.82247)"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" style="stop-color:#fff;stop-opacity:0"></stop>
      <stop offset=".446" style="stop-color:#fff;stop-opacity:.7"></stop>
      <stop offset=".548" style="stop-color:#fff;stop-opacity:.7"></stop>
      <stop offset="1" style="stop-color:#fff;stop-opacity:0"></stop>
    </linearGradient>
  </defs>
  <g>
    <path
      d="M6.998 1.638c2.778 0 5.056 2.197 5.266 4.963.01.137-.447.433-.447.433s.457.287.445.435c-.226 2.748-2.497 4.893-5.264 4.893-2.779 0-5.077-2.162-5.289-4.925-.01-.138.444-.418.444-.418s-.455-.275-.444-.41c.209-2.77 2.508-4.971 5.289-4.971"
      style={`fill: url(#${a}); fill-opacity: 1`}
    ></path>
    <path
      d="M6.713 1.638C3.972 1.766 1.82 3.695 1.483 6.3l-.075-.11s-.786.828-1.451.828c.67 0 1.45.83 1.45.83s.03-.047.076-.112c.338 2.607 2.5 4.507 5.25 4.625-2.657-.138-4.816-2.284-5.023-4.925.17-.208.38-.418.526-.418-.147 0-.355-.209-.526-.417.207-2.645 2.366-4.824 5.023-4.964zm.56 0c2.655.138 4.78 2.317 4.986 4.962-.174.213-.388.434-.538.434.15 0 .363.218.536.43-.217 2.63-2.336 4.762-4.983 4.898 2.739-.117 4.866-2.002 5.211-4.594l.064.095s.786-.83 1.451-.83c-.206 0-.423-.078-.624-.186a3.8 3.8 0 0 1-.827-.642s-.024.039-.06.091c-.335-2.61-2.467-4.54-5.217-4.658Z"
      style={`fill: url(#${b})`}
    ></path>
  </g>
</svg>
