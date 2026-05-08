<script lang="ts">
  import { resolve } from "$app/paths";

  const settingsPath = resolve("/settings");
</script>

<main class="w-[80%] pb-20">
  <div class="flex flex-col gap-8 mt-16">
    <h1 class="hook">Genshin Impact <br /> meta recommendations.</h1>
    <h2>
      Select your owned characters, <br />get team and character recommendations
    </h2>

    <p class="text-xs text-center mt-48" style="color: var(--foreground-mid);">
      adjust your roster in
      <a href={settingsPath} class="settings-link">settings</a>
    </p>
  </div>
</main>

<style>
  .hook {
    font-family: "Lora";
  }

  .settings-link {
    color: var(--foreground-color);
    transition: color 0.15s;
  }

  .settings-link:hover {
    color: var(--accent-1);
  }
</style>
