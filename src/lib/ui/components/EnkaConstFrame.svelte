<!-- Enka SvgIcon Const frame (viewBox 0 0 14 14).
     Parent `.locked` = dimmed / locked chrome (may be a hover projection).
     Parent `.truth-locked` = show the lock glyph for the real constellation. -->
<script lang="ts">
  let { uid = "c" }: { uid?: string } = $props();
  const fid = $derived(`enka-const-blur-${uid}`);
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class="SvgIcon Const"
  viewBox="0 0 14 14"
  aria-hidden="true"
>
  <defs>
    <filter
      id={fid}
      width="1.284"
      height="1.284"
      x="-.142"
      y="-.142"
      style="color-interpolation-filters:sRGB"
    >
      <feGaussianBlur stdDeviation=".808"></feGaussianBlur>
    </filter>
  </defs>
  <style>
    .locked .blur {
      fill: black;
      opacity: 0.2 !important;
    }
    .locked .tria1,
    .locked .tria2,
    .locked .tria3 {
      display: none;
    }
    .truth-locked .lock {
      opacity: 1 !important;
    }
    .locked .spikes {
      fill: black;
      opacity: 0.2 !important;
    }
    .locked .c1 {
      display: none;
    }
    .locked .c2 {
      fill: currentColor;
      filter: brightness(0.8);
    }
  </style>
  <g>
    <path
      fill="currentColor"
      d="M7.005 1.858c2.838 0 5.123 2.323 5.123 5.16a5.113 5.113 0 0 1-5.123 5.124c-2.838 0-5.16-2.285-5.16-5.123s2.322-5.161 5.16-5.161"
      class="blur"
      style={`filter: url(#${fid}); opacity: 0.50089286`}
    ></path>
    <path
      fill="currentColor"
      d="M6.977.064c-.03.787-.985 1.686-.985 1.686l.21.152a5.14 5.14 0 0 0-2.74 1.325l.142.275a4.85 4.85 0 0 1 2.937-1.34c.217.186.423.399.436.557.012-.158.208-.371.425-.557 1.139.1 2.166.595 2.944 1.344l.142-.281a5.15 5.15 0 0 0-2.746-1.323c.125-.09.217-.152.217-.152S7.006.845 6.977.064M2.498 4.438a5.14 5.14 0 0 0 .152 5.408c-.181-.041-.312-.08-.312-.08s-.056 1.274-.6 1.824c.626-.465 1.889-.334 1.889-.334s-.023-.143-.037-.332a5.15 5.15 0 0 0 2.592 1.199l.127-.287a4.85 4.85 0 0 1-2.733-1.332c.003-.264.036-.523.139-.627-.119.089-.381.085-.647.049a4.9 4.9 0 0 1-.687-1.29l.775-.591V7.4l-.088-.064.088-.066v-.332l-.304.23-.73-.564q.018-.22.058-.434l.976.752v-.324l-.92-.717c.118-.494.31-.958.565-1.381zm8.947 0-.302.062c.254.423.446.887.564 1.38l-.984.76v.587l.144.109-.144.115v.543l.84.65a5 5 0 0 1-.696 1.288c-.255.032-.505.029-.619-.057v.002c.1.099.137.346.143.598a4.85 4.85 0 0 1-2.756 1.36l.127.288a5.16 5.16 0 0 0 2.615-1.22c-.014.204-.037.353-.037.353s1.262-.13 1.889.334c-.547-.549-.602-1.824-.602-1.824s-.139.045-.332.088a5.14 5.14 0 0 0 .846-2.836c0-.941-.257-1.821-.696-2.58m.32 1.726q.038.213.057.434l-.736.57-.313-.238zm-9.658.758.536.414-.485.375a5 5 0 0 1-.05-.693zm9.73 0v.096c0 .24-.009.47-.042.7l-.5-.382zm-8.985.58.283.225-.84.65a5 5 0 0 1-.094-.37zm8.234 0 .65.514a5 5 0 0 1-.086.361l-.847-.65z"
      class="spikes"
      style="filter:saturate(1.2) brightness(1.2);opacity:0.34;stroke-width:14;paint-order:stroke markers fill"
    ></path>
    <path
      fill="currentColor"
      d="m6.977 11.611-.436.854.428.861.433-.853Z"
      class="tria1"
      style="opacity:0.34;stroke-width:14;paint-order:stroke markers fill"
    ></path>
    <path
      fill="currentColor"
      d="m11.867 3.074-.926.225-.384.875.933-.217z"
      class="tria2"
      style="opacity:0.34;stroke-width:14;paint-order:stroke markers fill"
    ></path>
    <path
      fill="currentColor"
      d="m2.078 3.074.383.883.926.217-.375-.875z"
      class="tria3"
      style="opacity:0.34;stroke-width:14;paint-order:stroke markers fill"
    ></path>
    <path
      fill="currentColor"
      d="M7 3.119c2.142 0 3.867 1.753 3.867 3.895A3.86 3.86 0 0 1 7 10.881c-2.142 0-3.895-1.725-3.895-3.867A3.907 3.907 0 0 1 7 3.12"
      class="backdrop"
    ></path>
    <path
      fill="rgba(0,0,0,0.8)"
      d="M7 3.119c2.142 0 3.867 1.753 3.867 3.895A3.86 3.86 0 0 1 7 10.881c-2.142 0-3.895-1.725-3.895-3.867A3.907 3.907 0 0 1 7 3.12"
      class="backdropBlack"
      style="filter:brightness(0.2);stroke-width:14.452;paint-order:stroke markers fill"
    ></path>
    <path
      fill="currentColor"
      d="M7 2.502c-2.475 0-4.484 2.037-4.484 4.512A4.487 4.487 0 0 0 7 11.498a4.487 4.487 0 0 0 4.484-4.484c0-2.475-2.01-4.512-4.484-4.512m0 .738c2.084 0 3.746 1.69 3.746 3.774A3.727 3.727 0 0 1 7 10.76c-2.084 0-3.773-1.663-3.773-3.746A3.774 3.774 0 0 1 7 3.24"
      class="c1"
      style="opacity:0.9;stroke-width:14;paint-order:stroke markers fill"
    ></path>
    <path
      fill="#fff"
      d="M7 2.967a4.06 4.06 0 0 0-4.047 4.047c0 2.223 1.824 4.02 4.047 4.02a4.015 4.015 0 0 0 4.02-4.02c0-2.223-1.797-4.047-4.02-4.047m0 .273c2.075 0 3.746 1.699 3.746 3.774A3.74 3.74 0 0 1 7 10.76c-2.075 0-3.773-1.671-3.773-3.746A3.785 3.785 0 0 1 7 3.24"
      class="c2"
      style="stroke-width:14;paint-order:stroke markers fill"
    ></path>
    <path
      fill="#fff"
      d="M7.017 5.224a.9.9 0 0 0-.897.897v.213h-.346a.117.117 0 0 0-.118.117v1.94a.117.117 0 0 0 .118.117h2.452a.117.117 0 0 0 .117-.117V6.45a.117.117 0 0 0-.117-.117h-.31V6.12a.9.9 0 0 0-.9-.897m0 .343a.57.57 0 0 1 .573.57v.197H6.446v-.196a.57.57 0 0 1 .57-.571M7 6.978a.32.32 0 0 1 .316.318.32.32 0 0 1-.188.289v.285c0 .05-.039.087-.088.087h-.083a.087.087 0 0 1-.088-.087v-.285a.32.32 0 0 1-.188-.289A.32.32 0 0 1 7 6.978"
      class="lock"
      style="opacity:0.00000001;stroke-width:0.0631447;paint-order:stroke markers fill"
    ></path>
  </g>
</svg>
