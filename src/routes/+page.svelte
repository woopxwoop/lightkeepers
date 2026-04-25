<script lang="ts">
  import { resolve } from "$app/paths";

  const settingsPath = resolve("/settings");
</script>

<main class="w-[92%] md:w-[80%] pb-20">
  <div class="flex flex-col gap-8">
    <p class="text-xs text-(--faint-color) text-center">
      adjust your roster in
      <a
        href={settingsPath}
        class="text-(--intermediate-color) hover:text-(--secondary-color) transition-colors"
      >
        settings
      </a>
    </p>
  </div>
</main>
