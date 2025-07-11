<script setup lang="ts">
import { Separator } from '@/components/ui/separator'
import Tasks from '@/components/task/Tasks.vue'
import Summary from '@/components/Summary.vue'
import CookingSuggestion from '@/components/CookingSuggestion.vue'
import MailList from '@/components/mail/MailList.vue'
</script>

<template>
    <div class="container mx-auto">
        <!-- Main Content Area -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Left Column: Summary -->
            <Summary />

            <!-- Right Column: Tasks and MailList stacked -->
            <div class="space-y-4">
                <Tasks />
                <MailList />
            </div>
        </div>


        <Separator orientation="horizontal" class="my-8 opacity-70"/>

        <!-- Cooking Suggestion Section -->
        <section>
            <CookingSuggestion/>
        </section>
    </div>
</template>
