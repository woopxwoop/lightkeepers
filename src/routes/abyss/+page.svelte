<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "$lib/supabaseClient";
  import type { Tables } from "$lib/types/database.types";

  type Team = Tables<"top_100_abyss_teams">;
  type CharacterMapping = Tables<"url_to_character_mapping">;

  let { data } = $props();

  let mapping: Map<string, string> = $derived(data.mapping);
  let teams: Team[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  $inspect(teams);

  onMount(async () => {
    try {
      // await getCharacterMapping();
      await getTopAbyssTeams();
    } catch (err) {
      error = err instanceof Error ? err.message : "An unknown error occurred";
      console.error("Error in onMount:", err);
    }
    loading = false;
  });

  const getCharacterMapping = async () => {
    const { data, error: err } = await db
      .from("url_to_character_mapping")
      .select("*");
    if (err) {
      throw new Error(err.message);
    } else {
      let arr = data as CharacterMapping[];
      arr.forEach((m) => {
        mapping.set(m.character_name, m.url);
      });
    }
  };

  const getTopAbyssTeams = async () => {
    const { data, error: err } = await db
      .from("top_100_abyss_teams")
      .select("*");
    if (err) {
      throw new Error(err.message);
    } else {
      teams = data;
    }
  };
</script>

<p>This is where the abyss page is</p>

{#if loading}
  <p>loading</p>
{:else if error}
  <p>{error}</p>
{:else}
  <p>got teams</p>
  <ul>
    {#each teams as team}
      <li>
        {#each team.members as member}
          <img src={mapping.get(member) ?? ""} alt="character portrait" />
        {/each}
      </li>
    {/each}
  </ul>
{/if}
