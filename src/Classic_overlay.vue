<template>
    <div class="CLASSIC_DOM">
        <fieldset>
            <legend>Select an action:</legend>
            <div>
                <input type="radio" id="palce" name="action" value="place" checked>
                <label for="place">Place Object</label>
            </div>
    
            <div>
                <input type="radio" id="measure" name="action" value="measure">
                <label for="measure">Measure Distance</label>
            </div>
        </fieldset>
        <video id="remoteVideo" class="clickable" autoplay style="height:100vh;"></video>
    </div>
</template>