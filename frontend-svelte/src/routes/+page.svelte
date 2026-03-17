<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  
  // Redirect to new Library page
  onMount(() => {
    goto('/library', { replaceState: true })
  })
</script>
